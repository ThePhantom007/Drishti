classdef ReduceMeanLayer1008 < nnet.layer.Layer & nnet.layer.Formattable
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
            name = 'severity_net.coder.ReduceMeanLayer1008';
        end
    end


    methods
        function this = ReduceMeanLayer1008(name)
            this.Name = name;
            this.OutputNames = {'x_blocks_blocks_3__8'};
        end

        function [x_blocks_blocks_3__8] = predict(this, x_blocks_blocks_3__2)
            if isdlarray(x_blocks_blocks_3__2)
                x_blocks_blocks_3__2 = stripdims(x_blocks_blocks_3__2);
            end
            x_blocks_blocks_3__2NumDims = 4;
            x_blocks_blocks_3__2 = severity_net.ops.permuteInputVar(x_blocks_blocks_3__2, [4 3 1 2], 4);

            [x_blocks_blocks_3__8, x_blocks_blocks_3__8NumDims] = ReduceMeanGraph1024(this, x_blocks_blocks_3__2, x_blocks_blocks_3__2NumDims, false);
            x_blocks_blocks_3__8 = severity_net.ops.permuteOutputVar(x_blocks_blocks_3__8, [3 4 2 1], 4);

            x_blocks_blocks_3__8 = dlarray(single(x_blocks_blocks_3__8), 'SSCB');
        end

        function [x_blocks_blocks_3__8] = forward(this, x_blocks_blocks_3__2)
            if isdlarray(x_blocks_blocks_3__2)
                x_blocks_blocks_3__2 = stripdims(x_blocks_blocks_3__2);
            end
            x_blocks_blocks_3__2NumDims = 4;
            x_blocks_blocks_3__2 = severity_net.ops.permuteInputVar(x_blocks_blocks_3__2, [4 3 1 2], 4);

            [x_blocks_blocks_3__8, x_blocks_blocks_3__8NumDims] = ReduceMeanGraph1024(this, x_blocks_blocks_3__2, x_blocks_blocks_3__2NumDims, true);
            x_blocks_blocks_3__8 = severity_net.ops.permuteOutputVar(x_blocks_blocks_3__8, [3 4 2 1], 4);

            x_blocks_blocks_3__8 = dlarray(single(x_blocks_blocks_3__8), 'SSCB');
        end

        function [x_blocks_blocks_3__8, x_blocks_blocks_3__8NumDims1026] = ReduceMeanGraph1024(this, x_blocks_blocks_3__2, x_blocks_blocks_3__2NumDims, Training)

            % Execute the operators:
            % ReduceMean:
            dims = severity_net.ops.prepareReduceArgs(this.Vars.ReduceMeanAxes1025, x_blocks_blocks_3__2NumDims);
            xMean = mean(x_blocks_blocks_3__2, dims);
            x_blocks_blocks_3__8 = xMean;
            x_blocks_blocks_3__8NumDims = x_blocks_blocks_3__2NumDims;

            % Set graph output arguments
            x_blocks_blocks_3__8NumDims1026 = x_blocks_blocks_3__8NumDims;

        end

    end

end