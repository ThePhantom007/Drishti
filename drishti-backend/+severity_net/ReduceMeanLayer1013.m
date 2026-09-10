classdef ReduceMeanLayer1013 < nnet.layer.Layer & nnet.layer.Formattable
    % A custom layer auto-generated while importing an ONNX network.

    %#ok<*PROPLC>
    %#ok<*NBRAK>
    %#ok<*INUSL>
    %#ok<*VARARG>
    properties (Learnable)
    end

    properties (State)
    end

    properties
        Vars
        NumDims
    end


    methods(Static, Hidden)
        % Specify the path to the class that will be used for codegen
        function name = matlabCodegenRedirect(~)
            name = 'severity_net.coder.ReduceMeanLayer1013';
        end
    end


    methods
        function this = ReduceMeanLayer1013(name)
            this.Name = name;
            this.OutputNames = {'x_blocks_blocks_4__8'};
        end

        function [x_blocks_blocks_4__8] = predict(this, x_blocks_blocks_4__2)
            if isdlarray(x_blocks_blocks_4__2)
                x_blocks_blocks_4__2 = stripdims(x_blocks_blocks_4__2);
            end
            x_blocks_blocks_4__2NumDims = 4;
            x_blocks_blocks_4__2 = severity_net.ops.permuteInputVar(x_blocks_blocks_4__2, [4 3 1 2], 4);

            [x_blocks_blocks_4__8, x_blocks_blocks_4__8NumDims] = ReduceMeanGraph1039(this, x_blocks_blocks_4__2, x_blocks_blocks_4__2NumDims, false);
            x_blocks_blocks_4__8 = severity_net.ops.permuteOutputVar(x_blocks_blocks_4__8, [3 4 2 1], 4);

            x_blocks_blocks_4__8 = dlarray(single(x_blocks_blocks_4__8), 'SSCB');
        end

        function [x_blocks_blocks_4__8] = forward(this, x_blocks_blocks_4__2)
            if isdlarray(x_blocks_blocks_4__2)
                x_blocks_blocks_4__2 = stripdims(x_blocks_blocks_4__2);
            end
            x_blocks_blocks_4__2NumDims = 4;
            x_blocks_blocks_4__2 = severity_net.ops.permuteInputVar(x_blocks_blocks_4__2, [4 3 1 2], 4);

            [x_blocks_blocks_4__8, x_blocks_blocks_4__8NumDims] = ReduceMeanGraph1039(this, x_blocks_blocks_4__2, x_blocks_blocks_4__2NumDims, true);
            x_blocks_blocks_4__8 = severity_net.ops.permuteOutputVar(x_blocks_blocks_4__8, [3 4 2 1], 4);

            x_blocks_blocks_4__8 = dlarray(single(x_blocks_blocks_4__8), 'SSCB');
        end

        function [x_blocks_blocks_4__8, x_blocks_blocks_4__8NumDims1041] = ReduceMeanGraph1039(this, x_blocks_blocks_4__2, x_blocks_blocks_4__2NumDims, Training)

            % Execute the operators:
            % ReduceMean:
            dims = severity_net.ops.prepareReduceArgs(this.Vars.ReduceMeanAxes1040, x_blocks_blocks_4__2NumDims);
            xMean = mean(x_blocks_blocks_4__2, dims);
            x_blocks_blocks_4__8 = xMean;
            x_blocks_blocks_4__8NumDims = x_blocks_blocks_4__2NumDims;

            % Set graph output arguments
            x_blocks_blocks_4__8NumDims1041 = x_blocks_blocks_4__8NumDims;

        end

    end

end