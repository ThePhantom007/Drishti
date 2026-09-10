classdef ReduceMeanLayer1022 < nnet.layer.Layer & nnet.layer.Formattable
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
            name = 'severity_net.coder.ReduceMeanLayer1022';
        end
    end


    methods
        function this = ReduceMeanLayer1022(name)
            this.Name = name;
            this.OutputNames = {'x_blocks_blocks_5_68'};
        end

        function [x_blocks_blocks_5_68] = predict(this, x_blocks_blocks_5_62)
            if isdlarray(x_blocks_blocks_5_62)
                x_blocks_blocks_5_62 = stripdims(x_blocks_blocks_5_62);
            end
            x_blocks_blocks_5_62NumDims = 4;
            x_blocks_blocks_5_62 = severity_net.ops.permuteInputVar(x_blocks_blocks_5_62, [4 3 1 2], 4);

            [x_blocks_blocks_5_68, x_blocks_blocks_5_68NumDims] = ReduceMeanGraph1066(this, x_blocks_blocks_5_62, x_blocks_blocks_5_62NumDims, false);
            x_blocks_blocks_5_68 = severity_net.ops.permuteOutputVar(x_blocks_blocks_5_68, [3 4 2 1], 4);

            x_blocks_blocks_5_68 = dlarray(single(x_blocks_blocks_5_68), 'SSCB');
        end

        function [x_blocks_blocks_5_68] = forward(this, x_blocks_blocks_5_62)
            if isdlarray(x_blocks_blocks_5_62)
                x_blocks_blocks_5_62 = stripdims(x_blocks_blocks_5_62);
            end
            x_blocks_blocks_5_62NumDims = 4;
            x_blocks_blocks_5_62 = severity_net.ops.permuteInputVar(x_blocks_blocks_5_62, [4 3 1 2], 4);

            [x_blocks_blocks_5_68, x_blocks_blocks_5_68NumDims] = ReduceMeanGraph1066(this, x_blocks_blocks_5_62, x_blocks_blocks_5_62NumDims, true);
            x_blocks_blocks_5_68 = severity_net.ops.permuteOutputVar(x_blocks_blocks_5_68, [3 4 2 1], 4);

            x_blocks_blocks_5_68 = dlarray(single(x_blocks_blocks_5_68), 'SSCB');
        end

        function [x_blocks_blocks_5_68, x_blocks_blocks_5_68NumDims1068] = ReduceMeanGraph1066(this, x_blocks_blocks_5_62, x_blocks_blocks_5_62NumDims, Training)

            % Execute the operators:
            % ReduceMean:
            dims = severity_net.ops.prepareReduceArgs(this.Vars.ReduceMeanAxes1067, x_blocks_blocks_5_62NumDims);
            xMean = mean(x_blocks_blocks_5_62, dims);
            x_blocks_blocks_5_68 = xMean;
            x_blocks_blocks_5_68NumDims = x_blocks_blocks_5_62NumDims;

            % Set graph output arguments
            x_blocks_blocks_5_68NumDims1068 = x_blocks_blocks_5_68NumDims;

        end

    end

end